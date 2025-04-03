import React from 'react';
import { format } from 'date-fns';
import {
    CodeBracketIcon,
    ChatBubbleLeftIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Contribution } from '../types';

interface ContributionTimelineProps {
    contributions: Contribution[];
}

const ContributionTimeline: React.FC<ContributionTimelineProps> = ({
    contributions
}) => {
    if (contributions.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-sm text-gray-500">No contributions yet</p>
            </div>
        );
    }

    const getStatusIcon = (status: Contribution['status']) => {
        switch (status) {
            case 'approved':
                return <CodeBracketIcon className="h-5 w-5 text-green-500" />;
            case 'pending':
                return <ArrowPathIcon className="h-5 w-5 text-yellow-500" />;
            case 'rejected':
                return <ChatBubbleLeftIcon className="h-5 w-5 text-red-500" />;
        }
    };

    return (
        <div className="flow-root">
            <ul role="list" className="-mb-8">
                {contributions.map((contribution, idx) => (
                    <li key={contribution.id}>
                        <div className="relative pb-8">
                            {idx !== contributions.length - 1 && (
                                <span
                                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                                    aria-hidden="true"
                                />
                            )}
                            <div className="relative flex space-x-3">
                                <div>
                                    <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center ring-8 ring-white">
                                        {getStatusIcon(contribution.status)}
                                    </span>
                                </div>
                                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                    <div>
                                        <p className="text-sm text-gray-500">
                                            {contribution.description}
                                        </p>
                                    </div>
                                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                                        <time dateTime={contribution.timestamp}>
                                            {format(new Date(contribution.timestamp), 'MMM d, yyyy')}
                                        </time>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ContributionTimeline;
