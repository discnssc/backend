const express = require('express');
const activitiesController = require('../controllers/activitiesController');

const router = express.Router();

router.get(
  '/:participantId/activity-logs',
  activitiesController.getActivityLogsForParticipant
);
router.get('/:activityId', activitiesController.getActivityWithAttendance);
router.get('/', activitiesController.getAllActivities);

router.post(
  '/participants/:participantId/activity-logs',
  activitiesController.createActivityLog
);

router.put('/:activityId/attendance', activitiesController.recordAttendance);

router.post('/', activitiesController.addActivity);
router.put('/:activityId', activitiesController.updateActivity);
router.delete('/:activityId', activitiesController.deleteActivity);

module.exports = router;
