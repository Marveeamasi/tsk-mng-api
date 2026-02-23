import { Router } from 'express';
import { taskController } from '../controllers/task.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All task routes require authentication
router.use(authenticate);

router.route('/')
  .get(taskController.findAll)
  .post(taskController.create);

router.route('/:id')
  .get(taskController.findById)
  .patch(taskController.update)
  .delete(taskController.delete);

router.post('/:id/comments', taskController.addComment);

export default router;
