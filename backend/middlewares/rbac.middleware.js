const Project = require('../models/Project');

const loadModel = (modelPath) => {
  try {
    return require(modelPath);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return null;
    throw error;
  }
};

const checkContextualAssignment = (requiredRole, paramName = 'projectId') => {
  return async (req, res, next) => {
    try {
      const entityId = req.params[paramName];
      if (!entityId) {
        return res.status(400).json({ success: false, message: 'Missing entity ID parameter' });
      }

      // Check dynamic roles requires LECTURER base profile linkage
      const lecturerId = req.user.lecturerId; 
      if (!lecturerId && requiredRole !== 'STUDENT') {
        return res.status(403).json({ success: false, message: 'User is not linked to a Lecturer profile' });
      }

      req.user.activeContextualRoles = req.user.activeContextualRoles || [];

      // Case 1: Supervisor contextual check
      if (requiredRole === 'SUPERVISOR') {
        const project = await Project.findById(entityId);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        
        if (project.supervisorId && project.supervisorId.toString() === lecturerId.toString()) {
          req.user.activeContextualRoles.push('SUPERVISOR');
          return next();
        }
      }

      // Case 2: Reviewer contextual check
      if (requiredRole === 'REVIEWER') {
        const project = await Project.findById(entityId);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
        
        if (project.reviewerId && project.reviewerId.toString() === lecturerId.toString()) {
          req.user.activeContextualRoles.push('REVIEWER');
          return next();
        }
      }

      // Case 3: Defense Committee Board contextual checks (Chair, Secretary, Member)
      if (['COMMITTEE_CHAIR', 'COMMITTEE_SECRETARY', 'COMMITTEE_MEMBER'].includes(requiredRole)) {
        const Committee = loadModel('../models/Committee');
        const DefenseSession = loadModel('../models/DefenseSession');
        if (!Committee || !DefenseSession) {
          return res.status(501).json({ success: false, message: 'Committee contextual authorization is not configured.' });
        }

        let committee;
        if (paramName === 'committeeId') {
          committee = await Committee.findById(entityId);
        } else if (paramName === 'projectId') {
          // Trace defense session associated with project to fetch the committee
          const session = await DefenseSession.findOne({ projectId: entityId });
          if (session) {
            committee = await Committee.findById(session.committeeId);
          }
        } else if (paramName === 'sessionId' || paramName === 'id') {
          const session = await DefenseSession.findById(entityId);
          if (session) {
            committee = await Committee.findById(session.committeeId);
          }
        }

        if (!committee) return res.status(404).json({ success: false, message: 'Committee board not found' });

        const member = committee.members.find(m => m.lecturerId.toString() === lecturerId.toString());
        if (member) {
          const roleMapping = {
            'COMMITTEE_CHAIR': 'COMMITTEE_CHAIR',
            'COMMITTEE_SECRETARY': 'COMMITTEE_SECRETARY',
            'REVIEWER': 'REVIEWER',
            'COMMITTEE_MEMBER': 'COMMITTEE_MEMBER',
          };
          const mappedRole = roleMapping[member.role] || 'COMMITTEE_MEMBER';
          
          if (mappedRole === requiredRole) {
            req.user.activeContextualRoles.push(requiredRole);
            return next();
          }
        }
      }

      return res.status(403).json({
        success: false,
        message: `Forbidden: Requires dynamic role assignment as ${requiredRole}`
      });
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { checkContextualAssignment };
