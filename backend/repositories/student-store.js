// Repository JSON: ghi nguyên tử, tuần tự hóa thay đổi, xóa mềm và nhật ký cùng record.
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export class DuplicateEmailError extends Error {
  constructor() { super('Email này đã được sử dụng, có thể thuộc hồ sơ trong thùng rác.'); this.name = 'DuplicateEmailError'; }
}
export class StudentNotFoundError extends Error {
  constructor() { super('Không tìm thấy sinh viên trong danh sách này.'); this.name = 'StudentNotFoundError'; this.status = 404; }
}
export class StudentCapacityError extends Error {
  constructor() { super('Đã sử dụng hết ID sinh viên từ 001 đến 999.'); this.status = 400; }
}
const fields = ['name', 'email', 'studentCode', 'phone', 'dob', 'className', 'status'];
const defaults = (student) => ({ studentCode: `SV${student.id}`, phone: '', dob: '', className: '', status: 'studying', createdAt: null, updatedAt: null, deletedAt: null, activity: [], ...student });
const matchesID = (student, id) => student.id === id || student.legacyId === id;

export function createStudentStore(filePath) {
  let writeQueue = Promise.resolve();
  async function readStudents() {
    const students = JSON.parse(await readFile(filePath, 'utf8'));
    if (!Array.isArray(students) || students.some((s) => (
      !s || ['id', 'name', 'email'].some((key) => typeof s[key] !== 'string' || !s[key].trim())
      || ['studentCode', 'phone', 'dob', 'className', 'status'].some((key) => s[key] !== undefined && typeof s[key] !== 'string')
      || ['createdAt', 'updatedAt', 'deletedAt'].some((key) => s[key] != null && (typeof s[key] !== 'string' || !Number.isFinite(Date.parse(s[key]))))
      || (s.activity !== undefined && (!Array.isArray(s.activity) || s.activity.some((event) => (
        !event || typeof event.id !== 'string' || typeof event.name !== 'string'
        || !['created', 'updated', 'deleted', 'restored'].includes(event.action)
        || typeof event.at !== 'string' || !Number.isFinite(Date.parse(event.at))
        || !Array.isArray(event.fields) || event.fields.some((key) => !fields.includes(key))
      ))))
    ))) throw new Error('students.json có cấu trúc không hợp lệ.');
    if (new Set(students.map((s) => s.id)).size !== students.length
      || new Set(students.map((s) => s.email.toLowerCase())).size !== students.length) {
      throw new Error('students.json chứa ID hoặc email trùng.');
    }
    return students.map(defaults);
  }
  async function saveStudents(students) {
    const temporaryFile = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryFile, `${JSON.stringify(students, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      await rename(temporaryFile, filePath);
    } finally {
      await unlink(temporaryFile).catch((error) => { if (error.code !== 'ENOENT') console.error(error); });
    }
  }
  function enqueue(operation) {
    const result = writeQueue.then(operation);
    writeQueue = result.catch(() => {});
    return result;
  }
  function assertEmail(students, email, exceptID) {
    if (students.some((s) => s.id !== exceptID && s.email.toLowerCase() === email.toLowerCase())) throw new DuplicateEmailError();
  }
  function record(student, action, changedFields = []) {
    const at = new Date().toISOString();
    student.updatedAt = at;
    student.activity.push({ id: randomUUID(), action, at, name: student.name, fields: changedFields });
    return at;
  }
  function findIn(students, id, deleted = false) {
    const student = students.find((s) => matchesID(s, id) && Boolean(s.deletedAt) === deleted);
    if (!student) throw new StudentNotFoundError();
    return student;
  }
  return {
    async list() { await writeQueue; return (await readStudents()).filter((s) => !s.deletedAt); },
    async trash() { await writeQueue; return (await readStudents()).filter((s) => s.deletedAt).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)); },
    async activity() {
      await writeQueue;
      return (await readStudents()).flatMap((s) => s.activity.map((event) => ({ ...event, studentId: s.id, deleted: Boolean(s.deletedAt) })))
        .sort((a, b) => b.at.localeCompare(a.at));
    },
    async find(id) { await writeQueue; return findIn(await readStudents(), id); },
    add(form) {
      return enqueue(async () => {
        const students = await readStudents();
        assertEmail(students, form.email);
        const used = new Set(students.map((s) => s.id));
        let id;
        for (let n = 1; n <= 999; n++) {
          const candidate = String(n).padStart(3, '0');
          if (!used.has(candidate)) { id = candidate; break; }
        }
        if (!id) throw new StudentCapacityError();
        const student = defaults({ ...Object.fromEntries(fields.filter((key) => form[key] !== undefined).map((key) => [key, form[key]])), id });
        if (!student.studentCode) student.studentCode = `SV${id}`;
        student.createdAt = record(student, 'created');
        await saveStudents([...students, student]);
        return student;
      });
    },
    update(id, form) {
      return enqueue(async () => {
        const students = await readStudents();
        const student = findIn(students, id);
        assertEmail(students, form.email, student.id);
        const changes = fields.filter((key) => form[key] !== undefined && student[key] !== form[key]);
        for (const key of changes) student[key] = form[key];
        if (changes.length) { record(student, 'updated', changes); await saveStudents(students); }
        return student;
      });
    },
    remove(id) {
      return enqueue(async () => {
        const students = await readStudents();
        const student = findIn(students, id);
        student.deletedAt = record(student, 'deleted');
        await saveStudents(students);
      });
    },
    restore(id) {
      return enqueue(async () => {
        const students = await readStudents();
        const student = findIn(students, id, true);
        assertEmail(students, student.email, student.id);
        student.deletedAt = null;
        record(student, 'restored');
        await saveStudents(students);
        return student;
      });
    },
  };
}
