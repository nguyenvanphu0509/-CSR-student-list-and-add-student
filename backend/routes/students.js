// Khai báo GET /students và POST /students, gọi controller tương ứng.
import { Router } from 'express';
import { createStudentController } from '../controllers/students.js';

export function createStudentRouter(store) {
  const router = Router();
  const controller = createStudentController(store);
  // Form HTML chỉ gửi GET/POST. Đổi method cho form của đúng một sinh viên.
  router.use((req, _res, next) => {
    if (req.method === 'POST' && /^\/[^/]+\/?$/.test(req.path)
      && ['PUT', 'DELETE'].includes(req.body?._method)) {
      req.method = req.body._method;
    }
    next();
  });
  router.get('/', controller.index);
  router.post('/', controller.create);
  router.post('/:id/restore', controller.restore);
  router.get('/:id/edit', controller.edit);
  router.get('/:id/delete', controller.confirmDelete);
  router.get('/:id', controller.show);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
