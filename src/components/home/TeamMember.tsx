import React from 'react';
import { View, Text, Image } from 'react-native';
import { styles } from '../../styles/globalStyles';

interface TeamMemberProps {
  name: string;
  role: string;
  image: string;
}

const TeamMember = ({ name, role, image }: TeamMemberProps) => {
  return (
    <View style={styles.teamMember}>
      <Image
        source={{ uri: image }}
        style={styles.teamImage}
      />
      <Text style={styles.teamName}>{name}</Text>
      <Text style={styles.teamRole}>{role}</Text>
    </View>
  );
};

export default TeamMember;
