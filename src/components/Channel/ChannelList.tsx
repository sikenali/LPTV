import React from 'react';
import ChannelCard from './ChannelCard';
import { Channel } from '../../types';

interface ChannelListProps {
  channels: Channel[];
  onChannelClick: (channel: Channel) => void;
}

const ChannelList: React.FC<ChannelListProps> = ({ channels, onChannelClick }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {channels.map((channel) => (
        <ChannelCard
          key={channel.id}
          channel={channel}
          onClick={() => onChannelClick(channel)}
        />
      ))}
    </div>
  );
};

export default ChannelList;
