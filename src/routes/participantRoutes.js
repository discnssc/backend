const express = require('express');
const participantController = require('../controllers/participantController');
const router = express.Router();

router.get('/', participantController.getParticipants);
router.get('/carepartners', participantController.getCarePartners);
router.get('/:participantid', participantController.getParticipantInfo);
router.get('/how/:participantid', participantController.getParticipantHOWInfo);
router.put('/:participantid', participantController.updateParticipant);
router.delete('/:participantid', participantController.deleteParticipant);

module.exports = router;
