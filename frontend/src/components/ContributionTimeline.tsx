import React from 'react';
import { useQuery } from 'react-query';
import { format } from 'date-fns';
import {
    CodeBracketIcon,
    ChatBubbleLeftIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import { fetchContributionTimeline } from '../api/projects';

interface ContributionTimelineProps {
    projectId: string;
}

const ContributionTimeline: React.FC<ContributionTimelineProps> = ({
    projectId
}) => {
    const { data: timeline, isLoading } = useQuery(
        ['contributionTimeline', projectId],
        () => fetchContributionTimeline(projectId)
    );

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
            </div>
        );
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'commit':
                return CodeBracketIcon;
            case 'comment':
                return ChatBubbleLeftIcon;
            default:
                return ArrowPathIcon;
        }
    };

    const getIconColor = (type: string) => {
        switch (type) {
            case 'commit':
                return 'bg-blue-100 text-blue-600';
            case 'comment':
                return 'bg-green-100 text-green-600';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="flow-root">
            <ul role="list" className="-mb-8">
                {timeline?.map((item, itemIdx) => {
                    const Icon = getIcon(item.type);
                    const iconColor = getIconColor(item.type);

                    return (
                        <li key={item.id}>
                            <div className="relative pb-8">
                                {itemIdx !== timeline.length - 1 ? (
                                    <span
                                        className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                                        aria-hidden="true"
                                    />
                                ) : null}
                                <div className="relative flex space-x-3">
                                    <div>
                                        <span
                                            className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${iconColor}`}
                                        >
                                            <Icon
                                                className="h-5 w-5"
                                                aria-hidden="true"
                                            />
                                        </span>
                                    </div>
                                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                        <div>
                                            <p className="text-sm text-gray-500">
                                                <span className="font-medium text-gray-900">
                                                    {item.user.username}
                                                </span>{' '}
                                                {item.action}{' '}
                                                <span className="font-medium text-gray-900">
                                                    {item.target}
                                                </span>
                                            </p>
                                            {item.description && (
                                                <p className="mt-2 text-sm text-gray-700">
                                                    {item.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="whitespace-nowrap text-right text-sm text-gray-500">
                                            <time
                                                dateTime={item.created_at}
                                                title={format(
                                                    new Date(item.created_at),
                                                    'PPpp'
                                                )}
                                            >
                                                {format(
                                                    new Date(item.created_at),
                                                    'MMM d, HH:mm'
                                                )}
                                            </time>
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

export default ContributionTimeline;
