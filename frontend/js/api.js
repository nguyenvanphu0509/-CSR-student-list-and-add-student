// Browser chỉ trao đổi JSON với Express; không tải HTML để thay danh sách.
async function request(path, options = {}) {
  const response = await fetch(`/api/students${path}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Không thể xử lý yêu cầu.');
    error.errors = data.errors || {};
    throw error;
  }
  return data;
}

export async function getStudents() {
  const { students } = await request('');
  return students;
}

export async function createStudent(input) {
  const { student } = await request('', { method: 'POST', body: JSON.stringify(input) });
  return student;
}
