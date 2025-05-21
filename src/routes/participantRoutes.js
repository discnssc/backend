const express = require('express');
const participantController = require('../controllers/participantController');
const activitiesController = require('../controllers/activitiesController');
const router = express.Router();

router.get('/', participantController.getParticipants);
router.get('/carepartners', participantController.getCarePartners);
router.get('/:participantid', participantController.getParticipantInfo);
router.get('/how/:participantid', participantController.getParticipantHOWInfo);
router.put('/:participantid', participantController.updateParticipant);
router.delete('/:participantid', participantController.deleteParticipant);
router.delete(
  '/:table/:participantid',
  participantController.deleteParticipantData
);

router.get(
  '/:participantId/activity-logs',
  activitiesController.getActivityLogs // maybe unecessary? but thought it was good to keep participant endpoints tgt
);

module.exports = router;
