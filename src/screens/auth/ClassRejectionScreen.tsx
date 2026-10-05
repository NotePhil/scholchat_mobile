import React from 'react';
import ClassLinkDecision from './ClassLinkDecision';

/** Reached via the emailed class-rejection link (no login required). Confirms before rejecting. */
const ClassRejectionScreen = () => <ClassLinkDecision action="reject" />;

export default ClassRejectionScreen;
