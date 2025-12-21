
# DAO Operation Validation — Proposal

Goal
- Ensure every important DAO operation is validated so callers can know whether the intended DB change actually occurred.

Summary of proposed solution
- Introduce a small validation layer and a Result<T> wrapper for DAO functions.
- Use mysql2 driver metadata (affectedRows, insertId, rows) to decide success.
- For multi-statement operations, require transactions and validate each step before commit.
- Prefer throwing detailed errors on failure for critical flows; for less-critical flows return structured result objects.
- Add tests and monitoring to prevent regressions.

Step-by-step implementation plan
1. Add a typed Result<T> and Error types (e.g. DaoResult<T>, DaoError) in src/dao/result.ts:
   - DaoResult<T> = { success: boolean; data?: T; meta?: { affectedRows?: number; insertId?: number; rows?: any[] }; error?: string; }
   - DaoError extends Error with extra meta fields.
2. Add small helpers that convert mysql2 execute results into DaoResult:
   - parseExecuteResult(result): returns { affectedRows, insertId } normalized from mysql2's ResultSetHeader.
   - parseQueryResult(result): returns rows array.
3. Update DAO functions to use getPool().execute/getPool().query then:
   - Validate based on operation type (INSERT -> affectedRows === 1 or insertId; UPDATE/DELETE -> affectedRows >= expected; SELECT -> rows length check).
   - Either throw DaoError on validation failure or return DaoResult with success=false and reason.
   - Example patterns:
     - createUser: insert -> check affectedRows === 1 -> return created entity or throw.
     - updateUser: update -> if affectedRows === 0 throw NotFoundError (or return success:false).
     - deleteUser: delete -> if affectedRows === 0 return success:false with reason 'not_found'.
4. Transactions for multi-step flows:
   - Use pool.getConnection() then conn.beginTransaction(), run steps using conn.execute(), validate each result, conn.commit() on success or conn.rollback() on any validation failure.
5. Tests:
   - Unit tests mocking mysql2 to simulate 0 affectedRows, constraint errors, connection errors.
   - Integration tests (test DB) to assert true behavior: failed insert due to unique key, update non-existent row -> appropriate error or result.
6. Logging & metrics:
   - Log validation failures with context (query type, params, userId, correlation id).
   - Create a metric counter for "dao.validation.failures" to detect trends.
7. Backwards compatibility:
   - Provide small adapters for existing callers: e.g., createUser() can keep returning {id,...} but internally validate and throw on failure; or introduce createUserValidated() if you want a phased rollout.

Why this approach
- Relying only on the absence of thrown exceptions is insufficient: many DB drivers return successful responses even when zero rows are affected.
- Using driver metadata (affectedRows, insertId) is lightweight and precise for most cases.
- Transactions ensure atomicity when multiple DB actions must all succeed.
- Standardized Result<T> simplifies caller logic and improves testability.

Example pseudocode (implementation guidance only)
- For INSERT:
  const [res] = await conn.execute(...);
  const meta = parseExecuteResult(res);
  if (meta.affectedRows !== 1) throw new DaoError('Insert failed', { meta });
  return { success: true, data: { id: meta.insertId }, meta };
- For UPDATE:
  const [res] = await conn.execute(...);
  const meta = parseExecuteResult(res);
  if (meta.affectedRows === 0) throw new NotFoundError('Row not found', { meta });

Testing suggestions
- Unit tests that stub execute() returning objects reflecting mysql2 responses:
  - Insert success: { affectedRows: 1, insertId: 123 }
  - Insert no-op: { affectedRows: 0 }
  - Update no-op: { affectedRows: 0 }
  - Query returning empty rows: []
- Integration tests against a real test DB (docker-compose) to assert correct behavior on constraint violations and transaction rollbacks.

Acceptance criteria
- Each DAO returns either:
  - Throws a DaoError on non-successful DB operation (recommended for critical actions), or
  - Returns DaoResult.success === true when operation had the expected effect.
- Unit/integration tests cover negative and positive cases for each DAO function.
- Logging shows meaningful context for validation failures.

References and sources
- mysql2 (npm) documentation (useful for understanding execute/query return shapes):
  https://github.com/sidorares/node-mysql2
- mysql2 Promise API examples:
  https://github.com/sidorares/node-mysql2#using-promise-wrapper
- MySQL documentation on result information (affected rows, insert id):
  https://dev.mysql.com/doc/refman/en/insert.html
- Pattern: use affectedRows/insertId to assert operation results (common practice in Node+MySQL apps):
  https://stackoverflow.com/questions/14716516/how-to-check-whether-mysql-update-query-has-updated-any-rows
- Transactions and error handling best practices:
  https://nodejs.dev/learn/working-with-databases-in-nodejs
  https://semaphoreci.com/community/tutorials/how-to-handle-transactions-in-nodejs
- Testing DB interactions:
  - Jest docs: https://jestjs.io/
  - Integration testing with dockerized DB: https://docs.docker.com/samples/testing/ci/

Migration checklist
- Add result helpers file and types.
- Update a small set of critical DAOs first (user create/auth flows).
- Add tests for those DAOs.
- Roll out changes to remaining DAOs.
- Monitor logs and metrics; revert/adjust patterns where noisy.

Notes
- This file is a proposal only. Implementing requires adding typed helpers, updating DAO functions, and adding tests — do not change runtime behavior until tests are in place.
