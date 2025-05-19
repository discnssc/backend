const express = require('express');
const participantController = require('../controllers/participantController');
const router = express.Router();

router.get('/', participantController.getParticipants);
router.get('/carepartners', participantController.getCarePartners);
router.get('/how/:participantid', participantController.getParticipantHOWInfo);
router.put('/:participantid', participantController.updateParticipant);
router.delete('/:participantid', participantController.deleteParticipant);
router.delete(
  '/:table/:participantid',
  participantController.deleteParticipantData
);
router.get('/:participantid', participantController.getParticipantInfo);

module.exports = router;
