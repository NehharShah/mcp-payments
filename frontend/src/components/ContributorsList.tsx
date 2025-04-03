import React from 'react';
import { useQuery } from 'react-query';
import { fetchContributors } from '../api/projects';
import { UserCircleIcon } from '@heroicons/react/24/solid';

interface ContributorsListProps {
    projectId: string;
}

const ContributorsList: React.FC<ContributorsListProps> = ({ projectId }) => {
    const { data: contributors, isLoading } = useQuery(
        ['contributors', projectId],
        () => fetchContributors(projectId)
    );

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
                {contributors?.map((contributor) => (
                    <li key={contributor.id} className="py-4">
                        <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                                {contributor.avatar_url ? (
                                    <img
                                        className="h-8 w-8 rounded-full"
                                        src={contributor.avatar_url}
                                        alt={contributor.username}
                                    />
                                ) : (
                                    <UserCircleIcon className="h-8 w-8 text-gray-400" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-gray-900">
                                    {contributor.username}
                                </p>
                                <p className="truncate text-sm text-gray-500">
                                    {contributor.contribution_count} contributions
                                </p>
                            </div>
                            <div>
                                <div className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                    {contributor.contribution_weight.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                        <div className="mt-2">
                            <div className="flex items-center text-sm text-gray-500">
                                <div className="flex-1">
                                    <div className="bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-indigo-600 rounded-full h-2"
                                            style={{
                                                width: `${contributor.contribution_weight}%`
                                            }}
                                        ></div>
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

export default ContributorsList;
