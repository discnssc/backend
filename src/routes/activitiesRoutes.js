const express = require('express');
const activitiesController = require('../controllers/activitiesController');

const router = express.Router();

/* GET /api/participants/:participantId/activity-logs */
router.get(
  '/:participantId/activity-logs',
  activitiesController.getActivityLogsForParticipant
);
/* GET /api/activities/:activityId */
router.get('/:activityId', activitiesController.getActivityWithAttendance);
/* GET /api/activities */
router.get('/', activitiesController.getAllActivities);

/* POST /api/participants/:participantId/activity-logs */
router.post(
  '/participants/:participantId/activity-logs',
  activitiesController.createActivityLog
);

/* PUT /activities/:activityId/attendance */
router.put('/:activityId/attendance', activitiesController.recordAttendance);

/* POST /activities */
router.post('/', activitiesController.addActivity);
/* PUT /activities/:activityId */
router.put('/:activityId', activitiesController.updateActivity);
/* DELETE /activities/:activityId */
router.delete('/:activityId', activitiesController.deleteActivity);

module.exports = router;
