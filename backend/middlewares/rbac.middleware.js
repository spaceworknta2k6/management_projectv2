const Project = require('../models/Project');

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
