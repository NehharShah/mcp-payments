import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchProjectContributions } from '../api/projects';
import { UserCircleIcon } from '@heroicons/react/24/solid';
import { Contribution } from '../types';

interface ContributorsListProps {
    projectId: string;
}

const ContributorsList: React.FC<ContributorsListProps> = ({ projectId }) => {
    const { data: contributions, isLoading } = useQuery({
        queryKey: ['contributors', projectId],
        queryFn: () => fetchProjectContributions(projectId)
    });

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="flow-root">
            <ul role="list" className="-my-5 divide-y divide-gray-200">
                {contributions?.map((contribution: Contribution) => (
                    <li key={contribution.id} className="py-4">
                        <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                                <UserCircleIcon className="h-8 w-8 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {contribution.contributor}
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                    {contribution.description}
                                </p>
                            </div>
                            <div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    contribution.status === 'approved' ? 'bg-green-100 text-green-800' :
                                    contribution.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                    {contribution.status}
                                </span>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default ContributorsList;
