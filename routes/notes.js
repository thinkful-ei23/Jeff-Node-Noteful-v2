'use strict';

const express = require('express');

// Create an router instance (aka "mini-app")
const knex = require('../knex');
const hydrateNotes = require('../utils/hydrateNotes');
const router = express.Router();

// TEMP: Simple In-Memory Database
// const data = require('../db/notes');
// const simDB = require('../db/simDB');
// const notes = simDB.initialize(data);

// Get All (and search by query)
router.get('/', (req, res, next) => {
  const {searchTerm} = req.query;
  const {folderId} = req.query;
  const {tagId} = req.query;
  knex.select('notes.id', 'title', 'content', 'folders.id as folderId', 'folders.name as folderName', 'tags.id as tagId', 'tags.name as tagName')
    .from('notes')
    .leftJoin('folders', 'notes.folder_id', 'folders.id')
    .leftJoin('notes_tags', 'notes.id', 'notes_tags.note_id')
    .leftJoin('tags', 'tags.id', 'notes_tags.tag_id')
    .modify(queryBuilder => {
      if (searchTerm) {
        queryBuilder.where('title', 'like', `%${searchTerm}%`);
      }
    })
    .modify(queryBuilder => {
      if (folderId) {
        queryBuilder.where('folder_id', folderId);
      }
    })
    .modify(queryBuilder => {
      if (tagId) {
        queryBuilder.where('tag_id', tagId);
      }
    })
    .orderBy('notes.id')
    .then(result => {
      if (result) {
        const hydrated = hydrateNotes(result);
        res.json(hydrated);
      } else {
        next();
      }
    })
    .catch(err => {
      next(err);
    });
});
// Get a single item
router.get('/:id', (req, res, next) => {
  const id = req.params.id;
  const { folderId } = req.query;

  knex
    .select('notes.id', 'title', 'content', 'folders.id as folderId', 'folders.name as folderName', 'tags.id as tagId', 'tags.name as tagName')
    .from('notes')
    .leftJoin('folders', 'notes.folder_id', 'folders.id')
    .leftJoin('notes_tags', 'notes.id', 'notes_tags.note_id')
    .leftJoin('tags', 'tags.id', 'notes_tags.tag_id')
    .modify(queryBuilder => {
      if (id) {
        queryBuilder.where('notes.id', id);
      }
    })
    .then(result => {
      if(result.length) {
        const hydrated = hydrateNotes(result);
            	res.json(hydrated[0]);
      } else {
        next();
      }
    })
	    .catch(err => {
	   	    next(err);
	 });
});

// PUT: update an item with an ID
router.put('/:id', (req, res, next) => {
  const noteId = req.params.id;
  const { title, content, folderId, tags =[] } = req.body;
  const updateObj = {
    title: title,
    content: content,
    folder_id: (folderId) ? folderId : null
  };

  /***** Never trust users - validate input *****/
  const updateableFields = ['title', 'content'];

  updateableFields.forEach(field => {
    if (field in req.body) {
      updateObj[field] = req.body[field];
    }
  });

  if (!updateObj.title) {
    const err = new Error('Missing `title` in request body');
    err.status = 400;
    return next(err);
  }
  /***** Never trust users - validate input *****/

  knex
    .update(updateObj)
    .from('notes')
    .where('notes.id', noteId)
    .then(() => {
      knex
        .delete()
        .from('notes_tags')
        .where('note_id', noteId);
    })
  //noteId lost its value????
    .then(() => {
      console.log(`heyyyyyy youuuuu ${noteId}`);
      const tagsInsert = tags.map((tag)=> ({ note_id: noteId, tag_id: tag.id }));
      return knex
        .insert(tagsInsert)
        .into('notes_tags');
    })
    .then(() => {
      return knex
        .select('notes.id', 'title', 'content', 'folder_id as folderId', 'folders.name as folderName', 'tags.name as tagName', 'tags.id as tagId')
        .from('notes')
        .leftJoin('folders', 'notes.folder_id', 'folders.id')
        .leftJoin('notes_tags', 'notes.id', 'note_id')
        .leftJoin('tags', 'tag_id', 'tags.id')
        .where('notes.id', noteId);
    })
    .then(result => {
      console.log(result);
      if (result) {
        const hydrated = hydrateNotes(result);
        res.json(hydrated);
      } else {
        next();
      }
    })
    .catch(err => next(err));
});


// Post (insert) an item
router.post('/', (req, res, next) => {
  const { title, content, folderId, tags } = req.body; // Add `folderId` and `tagId` to object destructure
  const newItem = {
    title: title,
    content: content,
    folder_id: (folderId) ? folderId : null // Add `folderId`
  };

  let noteId;
  // Insert new note into notes table
  knex.insert(newItem)
    .into('notes')
    .returning('id')
    .then(([id]) => {
	        // Insert related tags into notes_tags table
      noteId = id;
      const tagsInsert = tags.map(tagId => ({note_id: noteId, tag_id: tagId}));
      return knex.insert(tagsInsert).into('notes_tags');
    })
	    .then(() => {
	    	// Select the new note and leftJoin on folders and tags
      return knex.select('notes.id', 'title', 'content', 'folder_id as folderId', 'folders.name as folderName', 'tags.id as tagId', 'tags.name as tagName')
        .from('notes')
        .leftJoin('folders', 'notes.folder_id', 'folders.id')
	            .leftJoin('notes_tags', 'notes.id', 'notes_tags.note_id')
	            .leftJoin('tags', 'tags.id', 'notes_tags.tag_id')
        .where('notes.id', noteId);
    })
    .then((result) => {
        	if (result) {
		        // Hydrate the results
        		const hydrated = hydrateNotes(result)[0];
		        // Respond with a location header, a 201 status and a note object

        res.location(`${req.originalUrl}/${hydrated.id}`).status(201).json(hydrated);
        	} else {
        	next();
        	}
    })
    .catch(err => next(err));
});


// Delete an item
router.delete('/:id', (req, res, next) => {
  const id = req.params.id;

  knex
	    .delete()
	    .from('notes')
    .where({'notes.id': id})
    .then(() => {
      res.sendStatus(204);
    })
	    .catch(err => {
      next(err);
    });
});

module.exports = router;
