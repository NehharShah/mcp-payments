import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { Tab } from '@headlessui/react';
import { Project, Contribution, Payment } from '../types';
import ContributorsList from '../components/ContributorsList';
import PaymentModal from '../components/PaymentModal';
import PaymentHistory from '../components/PaymentHistory';
import ContributionTimeline from '../components/ContributionTimeline';
import { fetchProjectDetails } from '../api/projects';

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

const ProjectDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const { data: project, isLoading } = useQuery(['project', id], () =>
        fetchProjectDetails(id!)
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="text-center py-12">
                <h2 className="text-2xl font-semibold text-gray-900">
                    Project not found
                </h2>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <div className="sm:flex sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                {project.name}
                            </h2>
                            <p className="mt-1 text-sm text-gray-500">
                                {project.description}
                            </p>
                        </div>
                        <div className="mt-4 sm:mt-0">
                            <button
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Process Payment
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
                        <div className="bg-gray-50 px-4 py-5 sm:p-6 rounded-lg">
                            <dt className="text-sm font-medium text-gray-500">
                                Total Paid
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                                {project.total_paid} USDC
                            </dd>
                        </div>
                        <div className="bg-gray-50 px-4 py-5 sm:p-6 rounded-lg">
                            <dt className="text-sm font-medium text-gray-500">
                                Contributors
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                                {project.contributors_count}
                            </dd>
                        </div>
                        <div className="bg-gray-50 px-4 py-5 sm:p-6 rounded-lg">
                            <dt className="text-sm font-medium text-gray-500">
                                Contribution Score
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                                {project.contribution_score}
                            </dd>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow sm:rounded-lg">
                <Tab.Group>
                    <Tab.List className="border-b border-gray-200">
                        <div className="px-4 sm:px-6">
                            <nav className="-mb-px flex space-x-8">
                                {['Contributors', 'Payments', 'Activity'].map(
                                    (tab) => (
                                        <Tab
                                            key={tab}
                                            className={({ selected }) =>
                                                classNames(
                                                    selected
                                                        ? 'border-indigo-500 text-indigo-600'
                                                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                                                    'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none'
                                                )
                                            }
                                        >
                                            {tab}
                                        </Tab>
                                    )
                                )}
                            </nav>
                        </div>
                    </Tab.List>
                    <Tab.Panels className="p-4 sm:p-6">
                        <Tab.Panel>
                            <ContributorsList projectId={id!} />
                        </Tab.Panel>
                        <Tab.Panel>
                            <PaymentHistory projectId={id!} />
                        </Tab.Panel>
                        <Tab.Panel>
                            <ContributionTimeline projectId={id!} />
                        </Tab.Panel>
                    </Tab.Panels>
                </Tab.Group>
            </div>

            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                project={project}
            />
        </div>
    );
};

export default ProjectDetail;
