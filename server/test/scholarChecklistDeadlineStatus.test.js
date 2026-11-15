const assert = require('node:assert/strict');
const { test } = require('node:test');

const dateOnly = (date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const createChecklist = async ({ dueDate, status }) => {
  const { buildScholarChecklist } = await import('../../client/src/utils/scholarChecklist.js');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskCreated = new Date(today);
  taskCreated.setDate(taskCreated.getDate() - 3);
  const task = {
    id: 1,
    type: 'Monthly Report',
    title: 'Monthly Report',
    created_at: dateOnly(taskCreated),
    due_date: dueDate,
    source: 'manual',
  };
  const history = status
    ? [{
        submission_type: 'letter',
        status,
        submitted_at: `${dateOnly(taskCreated)} 10:00:00`,
        approved_at: status === 'approved' ? `${dateOnly(today)} 09:00:00` : null,
      }]
    : [];
  return buildScholarChecklist({ tasks: [task], history })[0];
};

test('on-time submissions complete the task at deadline without approving the review', async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const overduePending = await createChecklist({ dueDate: dateOnly(yesterday), status: 'pending' });
  assert.equal(overduePending.status, 'completed');
  assert.equal(overduePending.done, true);
  assert.equal(overduePending.reviewStatus, 'pending_review');

  const futurePending = await createChecklist({ dueDate: dateOnly(tomorrow), status: 'pending' });
  assert.equal(futurePending.status, 'pending_review');
  assert.equal(futurePending.done, false);

  const overdueUnsubmitted = await createChecklist({ dueDate: dateOnly(yesterday) });
  assert.equal(overdueUnsubmitted.status, 'closed');
  assert.equal(overdueUnsubmitted.reviewStatus, null);

  const overdueApproved = await createChecklist({ dueDate: dateOnly(yesterday), status: 'approved' });
  assert.equal(overdueApproved.status, 'completed');
  assert.equal(overdueApproved.reviewStatus, 'approved');

  const overdueReturned = await createChecklist({ dueDate: dateOnly(yesterday), status: 'returned' });
  assert.equal(overdueReturned.status, 'closed');
  assert.equal(overdueReturned.reviewStatus, 'returned');
});
