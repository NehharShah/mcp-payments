import React from 'react';
import { Activity } from '../types';
import { format } from 'date-fns';
import {
    CurrencyDollarIcon,
    CodeBracketIcon,
    FlagIcon
} from '@heroicons/react/24/outline';

interface ActivityFeedProps {
    activities: Activity[];
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
    const getIcon = (type: Activity['type']) => {
        switch (type) {
            case 'payment':
                return CurrencyDollarIcon;
            case 'milestone':
                return FlagIcon;
            default:
                return CodeBracketIcon;
        }
    };

    const getIconColor = (type: Activity['type']) => {
        switch (type) {
            case 'payment':
                return 'bg-green-100 text-green-600';
            case 'milestone':
                return 'bg-purple-100 text-purple-600';
            default:
                return 'bg-blue-100 text-blue-600';
        }
    };

    return (
        <div className="flow-root">
            <ul role="list" className="-mb-8">
                {activities.map((activity, idx) => {
                    const Icon = getIcon(activity.type);
                    const iconColor = getIconColor(activity.type);

                    return (
                        <li key={activity.id}>
                            <div className="relative pb-8">
                                {idx !== activities.length - 1 && (
                                    <span
                                        className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-gray-200"
                                        aria-hidden="true"
                                    />
                                )}
                                <div className="relative flex items-start space-x-3">
                                    <div
                                        className={`relative p-2 rounded-full ${iconColor}`}
                                    >
                                        <Icon
                                            className="h-5 w-5"
                                            aria-hidden="true"
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div>
                                            <div className="text-sm">
                                                <span className="font-medium text-gray-900">
                                                    {activity.title}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 text-sm text-gray-500">
                                                {activity.description}
                                            </p>
                                            {activity.amount && (
                                                <p className="mt-0.5 text-sm font-medium text-green-600">
                                                    {activity.amount}{' '}
                                                    {activity.currency}
                                                </p>
                                            )}
                                            <p className="mt-2 text-xs text-gray-500">
                                                {format(
                                                    new Date(activity.created_at),
                                                    'MMM d, yyyy HH:mm'
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ActivityFeed;
