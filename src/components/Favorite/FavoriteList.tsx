import React from 'react';
import FavoriteCard from './FavoriteCard';
import EmptyState from './EmptyState';
import { Channel } from '../../types';

interface FavoriteListProps {
  channels: Channel[];
  onChannelClick: (channel: Channel) => void;
}

const FavoriteList: React.FC<FavoriteListProps> = ({ channels, onChannelClick }) => {
  if (channels.length === 0) return <EmptyState />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {channels.map((channel) => (
        <FavoriteCard
          key={channel.id}
          channel={channel}
          onClick={() => onChannelClick(channel)}
        />
      ))}
    </div>
  );
};

export default FavoriteList;
