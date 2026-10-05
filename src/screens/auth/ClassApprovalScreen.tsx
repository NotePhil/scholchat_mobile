import React from 'react';
import ClassLinkDecision from './ClassLinkDecision';

/** Reached via the emailed class-approval link (no login required). Confirms before approving. */
const ClassApprovalScreen = () => <ClassLinkDecision action="approve" />;

export default ClassApprovalScreen;
