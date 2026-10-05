import React, { useEffect } from "react";
import { View } from "react-native";
import { useUser } from "../../context/UserContext";
import { useSelectedChildStore } from "../../store/useSelectedChildStore";
import StudentCoursesBody from "../student/StudentCoursesBody";
import ChildSelectorRow from "./ChildSelectorRow";

/**
 * Parent "Cours" tab — web renders the same CoursProgrammeManagement as the
 * student, fed with `selectedChildId`. So does mobile: the student's course
 * list (GET /cours-programmes/accessible/{childId} + /cours/accessibles),
 * with the child switcher on top; opening a course shows its chapters with
 * the child's progress, read-only.
 */
const ParentCoursesBody = () => {
  const { user } = useUser();
  const { children, selectedChildId, loadChildren } = useSelectedChildStore();

  useEffect(() => {
    if (user?.userId) loadChildren(user.userId);
  }, [user?.userId, loadChildren]);

  const child = children.find((c) => c.id === selectedChildId);

  return (
    <View style={{ flex: 1 }}>
      <StudentCoursesBody
        learnerId={selectedChildId}
        childName={child?.prenom || child?.nom || ""}
        topSlot={<ChildSelectorRow />}
      />
    </View>
  );
};

export default ParentCoursesBody;
