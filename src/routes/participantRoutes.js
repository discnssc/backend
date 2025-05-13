const express = require('express');
const participantController = require('../controllers/participantController');
const router = express.Router();

// Attendance routes
router.get('/attendance', participantController.getAllParticipantAttendance);
router.get('/attendance/:participantid', participantController.getParticipantAttendance);
router.post('/attendance', participantController.upsertParticipantAttendance);
router.delete('/attendance/:id', participantController.deleteParticipantAttendance);

// Scheudle routes
router.get('/schedules', participantController.getAllParticipantSchedules);
router.get('/schedule/:participantid', participantController.getParticipantSchedule);
router.post('/schedule/:participantid', participantController.upsertParticipantSchedule);
router.delete('/schedule/:participantid/:month/:year', participantController.deleteParticipantSchedule);

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
