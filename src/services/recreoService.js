import { AppError } from '../lib/errors.js';
import { boolean, integer, text, timeHHMM } from '../lib/validation.js';
import { createRecreoRepository } from '../repositories/recreoRepository.js';

function parseRecreoInput(input) {
  const name = text(input.name, 'name', { min: 3, max: 60 });
  const startTime = timeHHMM(input.startTime, 'startTime');
  const endTime = timeHHMM(input.endTime, 'endTime');
  if (startTime >= endTime) {
    throw AppError.badRequest('INVALID_TIME_RANGE', 'El horario de fin debe ser posterior al de inicio.', {
      endTime: 'Debe ser posterior al horario de inicio.',
    });
  }
  return {
    name,
    startTime,
    endTime,
    sortOrder: input.sortOrder === undefined ? 0 : integer(input.sortOrder, 'sortOrder', { min: 0, max: 999 }),
    active: input.active === undefined ? true : boolean(input.active, 'active'),
  };
}

export function createRecreoService({ db }) {
  const recreos = createRecreoRepository(db);

  return {
    listAll() {
      return recreos.list();
    },

    create(input) {
      const data = parseRecreoInput(input);
      if (recreos.findByName(data.name)) {
        throw AppError.conflict('RECREO_EXISTS', 'Ya existe un recreo con ese nombre.');
      }
      return recreos.create(data);
    },

    update(id, input) {
      const recreoId = integer(id, 'id', { min: 1 });
      const existing = recreos.findById(recreoId);
      if (!existing) throw AppError.notFound('RECREO_NOT_FOUND', 'El recreo no existe.');
      const data = parseRecreoInput({ ...existing, ...input });
      const duplicated = recreos.findByName(data.name);
      if (duplicated && duplicated.id !== recreoId) {
        throw AppError.conflict('RECREO_EXISTS', 'Ya existe un recreo con ese nombre.');
      }
      return recreos.update(recreoId, data);
    },

    remove(id) {
      const recreoId = integer(id, 'id', { min: 1 });
      const existing = recreos.findById(recreoId);
      if (!existing) throw AppError.notFound('RECREO_NOT_FOUND', 'El recreo no existe.');

      if (recreos.countOrders(recreoId) > 0) {
        return { deleted: false, archived: true, recreo: recreos.update(recreoId, { ...existing, active: false }) };
      }
      recreos.remove(recreoId);
      return { deleted: true, archived: false };
    },
  };
}
