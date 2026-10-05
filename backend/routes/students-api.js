import { Router } from 'express';
import { createStudentController } from '../controllers/students.js';

// API luôn trả JSON, kể cả khi client không gửi Accept.
export function createStudentsAPI(store) {
  const router = Router();
  const controller = createStudentController(store);
  router.get('/', controller.apiIndex);
  router.get('/:id', controller.apiShow);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
