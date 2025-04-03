import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tab } from '@headlessui/react';
import ContributorsList from '../components/ContributorsList';
import PaymentModal from '../components/PaymentModal';
import PaymentHistory from '../components/PaymentHistory';
import ContributionTimeline from '../components/ContributionTimeline';
import { fetchProject, fetchProjectPayments, fetchProjectContributions } from '../api/projects';
import { Project } from '../types';

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ');
}

const ProjectDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const { data: project, isLoading: projectLoading } = useQuery<Project>({
        queryKey: ['project', id],
        queryFn: () => fetchProject(id!),
        enabled: !!id
    });

    const { data: payments = [] } = useQuery({
        queryKey: ['projectPayments', id],
        queryFn: () => fetchProjectPayments(id!),
        enabled: !!id
    });

    const { data: contributions = [] } = useQuery({
        queryKey: ['projectContributions', id],
        queryFn: () => fetchProjectContributions(id!),
        enabled: !!id
    });

    if (projectLoading) {
        return (
            <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-500">Project not found</p>
            </div>
        );
    }

    return (
        <div>
            <div className="md:flex md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        {project.name}
                    </h2>
                </div>
                <div className="mt-4 flex md:ml-4 md:mt-0">
                    <button
                        type="button"
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="ml-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                        Create Payment
                    </button>
                </div>
            </div>

            <div className="mt-8">
                <Tab.Group>
                    <Tab.List className="flex space-x-8 border-b border-gray-200">
                        {['Overview', 'Payments', 'Contributors'].map((tab) => (
                            <Tab
                                key={tab}
                                className={({ selected }) =>
                                    classNames(
                                        'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                                        'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium',
                                        selected
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                    )
                                }
                            >
                                {tab}
                            </Tab>
                        ))}
                    </Tab.List>
                    <Tab.Panels className="mt-4">
                        <Tab.Panel>
                            <div className="prose max-w-none">
                                <p>{project.description}</p>
                            </div>
                            <div className="mt-8">
                                <ContributionTimeline contributions={contributions} />
                            </div>
                        </Tab.Panel>
                        <Tab.Panel>
                            <PaymentHistory payments={payments} />
                        </Tab.Panel>
                        <Tab.Panel>
                            <ContributorsList projectId={id!} />
                        </Tab.Panel>
                    </Tab.Panels>
                </Tab.Group>
            </div>

            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                projectId={id!}
            />
        </div>
    );
};

export default ProjectDetail;
