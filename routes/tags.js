'use strict';

const express = require('express');
const knex = require('../knex');
const router = express.Router();

/* ========== GET ALL ITEMS ========== */
router.get('/', (req, res, next) => {

    knex.select('id', 'name')
        .from('tags')
        .then(results => {
            res.json(results);
        })
        .catch(err => next(err));

});

/* ========== GET BY ID/GET A SINGLE ITEM ========== */

router.get('/:id', (req, res, next) => {
	const id = req.params.id;

	knex
		.first('id', 'name')
		.from('tags')
		.where({'id': id})
		.then(result => {
			if(result) {
				res.json(result);
			} else {
				next();
			}
		}).catch(err => {
		next(err);
	});
});

/* ========== POST/CREATE ITEM ========== */
router.post('/', (req, res, next) => {
	const { name } = req.body;

	/***** Never trust users. Validate input *****/
	if (!name) {
		const err = new Error('Missing `name` in request body');
		err.status = 400;
		return next(err);
	}

	const newItem = { name };

	knex.insert(newItem)
		.into('tags')
		.returning(['id', 'name'])
		.then((results) => {
			// Uses Array index solution to get first item in results array
			const result = results[0];
			res.location(`${req.originalUrl}/${result.id}`).status(201).json(result);
		})
		.catch(err => next(err));
});

/* ========== PUT/UPDATE ITEM ========== */

router.put('/:id', (req, res, next) => {
	const id = req.params.id;

	/***** Never trust users - validate input *****/
	const updateObj = {};
	const updateableFields = ['name'];

	updateableFields.forEach(field => {
		if (field in req.body) {
			updateObj[field] = req.body[field];
		}
	});

	/***** Never trust users - validate input *****/
	if (!updateObj.name) {
		const err = new Error('Missing `name` in request body');
		err.status = 400;
		return next(err);
	}

	knex('tags')
		.where('id', id)
		.update(updateObj)
		.returning(['id', 'name'])
		.then(([result]) => {
			if(result) {
				res.status(200);
				res.json(result);
			} else {
				next();
			}
		})
		.catch(err =>
			next(err)
		);
});

/* ========== DELETE ITEM ========== */
router.delete('/:id', (req, res, next) => {
	const id = req.params.id;

	knex('tags')
		.where({'tags.id': id})
		.del()
		.then(() => {
			res.sendStatus(204);
		}).catch(err => {
		next(err);
	});
});

module.exports = router;
































module.exports = router;

