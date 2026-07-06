const prisma = require('../config/prisma');
const { randomBytes } = require('crypto');
const { isObjectId } = require('../utils/object-id');

const newObjectId = () => randomBytes(12).toString('hex');
const toId = (val) => {
  if (!val) return null;
  if (typeof val === 'object' && val.toString) return val.toString();
  return String(val);
};

const makeMockModel = (prismaName, prismaQueryMapper = null) => {
  return {
    deleteMany: async () => {
      // Mock, the test itself usually has prisma deleteMany right after
      return { acknowledged: true, deletedCount: 0 };
    },
    create: async (data) => {
      const id = data._id ? toId(data._id) : newObjectId();
      return {
        ...data,
        _id: id,
        id: id,
        save: async function() { return this; }
      };
    },
    findOne: async (filter = {}) => {
      if (!prismaName) return null;
      const where = {};
      const noIsDeletedModels = ['workflowEvent', 'scoreSheet', 'finalGrade', 'chatRoom', 'chatMessage', 'chatRoomMember', 'notification'];
      if (!noIsDeletedModels.includes(prismaName)) {
        where.isDeleted = false;
      }
      
      // Simple filter mapping
      if (filter.email) where.email = filter.email;
      if (filter._id) where.id = toId(filter._id);
      if (filter.userId) where.userId = toId(filter.userId);
      if (filter.topicId) where.topicId = toId(filter.topicId);
      if (filter.periodId) where.periodId = toId(filter.periodId);
      if (filter.name) where.name = filter.name;
      if (filter.projectId) where.projectId = toId(filter.projectId);
      if (filter.entityId) where.entityId = toId(filter.entityId);
      if (filter.action) where.action = filter.action;

      if (prismaQueryMapper) {
        Object.assign(where, prismaQueryMapper(filter));
      }

      const res = await prisma[prismaName].findFirst({ where });
      if (!res) return null;
      return {
        ...res,
        _id: res.id,
        save: async function() { return this; }
      };
    },
    findById: async (id) => {
      if (!prismaName) return null;
      const res = await prisma[prismaName].findUnique({
        where: { id: toId(id) }
      });
      if (!res) return null;
      const noIsDeletedModels = ['workflowEvent', 'scoreSheet', 'finalGrade', 'chatRoom', 'chatMessage', 'chatRoomMember', 'notification'];
      if (!noIsDeletedModels.includes(prismaName) && res.isDeleted) {
        return null;
      }
      return {
        ...res,
        _id: res.id,
        save: async function() { return this; }
      };
    },
    updateOne: async () => {
      return { acknowledged: true, modifiedCount: 1 };
    },
    findOneAndUpdate: async () => {
      return { save: async function() { return this; } };
    },
    findByIdAndUpdate: async () => {
      return { save: async function() { return this; } };
    },
    findByIdAndDelete: async () => {
      return { acknowledged: true, deletedCount: 1 };
    },
    updateMany: async () => {
      return { acknowledged: true, modifiedCount: 1 };
    },
    find: (filter = {}) => {
      const where = {};
      if (filter.entityType) where.entityType = filter.entityType;
      if (filter.entityId) where.entityId = toId(filter.entityId);
      if (filter.email) where.email = filter.email;

      return {
        setOptions: () => {
          return [];
        },
        sort: (sortSpec = {}) => {
          return {
            then: async (resolve, reject) => {
              try {
                const results = await prisma[prismaName].findMany({
                  where,
                  orderBy: { createdAt: 'asc' }
                });
                resolve(results.map(r => ({ ...r, _id: r.id })));
              } catch (e) {
                reject(e);
              }
            }
          };
        },
        then: async (resolve, reject) => {
          try {
            const results = await prisma[prismaName].findMany({ where });
            resolve(results.map(r => ({ ...r, _id: r.id })));
          } catch (e) {
            reject(e);
          }
        }
      };
    }
  };
};

const ObjectIdMock = function(val) {
  if (!(this instanceof ObjectIdMock)) {
    return new ObjectIdMock(val);
  }
  const id = val ? toId(val) : newObjectId();
  this.toString = () => id;
  return this;
};
ObjectIdMock.isValid = (id) => isObjectId(id);

const db = {
  disconnect: async () => {
    console.log('Prisma compatibility DB disconnect.');
  },
  connect: async () => {
    console.log('Prisma compatibility DB connect.');
  },
  connection: {
    db: {
      collection: () => ({
        find: () => ({
          project: () => ({
            toArray: async () => []
          })
        }),
        deleteMany: async () => ({})
      })
    }
  },
  Types: {
    ObjectId: ObjectIdMock
  }
};

module.exports = {
  prisma,
  db,
  newObjectId,
  User: makeMockModel('user'),
  Lecturer: makeMockModel('lecturer'),
  Student: makeMockModel('student'),
  ProjectPeriod: makeMockModel('projectPeriod'),
  ProjectRoster: makeMockModel('projectRoster'),
  ProjectGroup: makeMockModel('projectGroup'),
  ProjectTopic: makeMockModel('projectTopic'),
  Project: makeMockModel('project'),
  WorkflowEvent: makeMockModel('workflowEvent'),
  Milestone: makeMockModel('milestone'),
  SubmissionPackage: makeMockModel('submissionPackage'),
  ExtensionRequest: makeMockModel('extensionRequest'),
  TopicChangeRequest: makeMockModel('topicChangeRequest'),
  EvaluationRubric: makeMockModel('evaluationRubric'),
  FileAsset: makeMockModel('fileAsset'),
  ChatRoom: makeMockModel('chatRoom'),
  ChatMessage: makeMockModel('chatMessage'),
  Notification: makeMockModel('notification'),
  ScoreSheet: makeMockModel('scoreSheet'),
  Appeal: makeMockModel('appeal'),
  FinalGrade: makeMockModel('finalGrade'),
  AppealRequest: makeMockModel('appealRequest'),
};
