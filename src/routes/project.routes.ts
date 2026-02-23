import { Router } from 'express';
import { projectController } from '../controllers/project.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.route('/')
  .get(projectController.findAll)
  .post(projectController.create);

router.route('/:id')
  .get(projectController.findById)
  .patch(projectController.update)
  .delete(projectController.delete);

router.post('/:id/members', projectController.addMember);
router.delete('/:id/members/:memberId', projectController.removeMember);

export default router;
