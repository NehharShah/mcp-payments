import React from 'react';
import { Link } from 'react-router-dom';
import { Project } from '../types';
import { format } from 'date-fns';
import { UserGroupIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

interface ProjectCardProps {
  project: Project;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const statusColors = {
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <Link to={`/projects/${project.id}`} className="block">
      <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-300">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{project.description}</p>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                statusColors[project.status]
              }`}
            >
              {project.status}
            </span>
          </div>
          <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-1.5 text-gray-400" aria-hidden="true" />
              {project.contributors.length} Contributors
            </div>
            <div className="flex items-center">
              <CurrencyDollarIcon className="h-5 w-5 mr-1.5 text-gray-400" aria-hidden="true" />
              {project.totalPayments} USDC
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Created {format(new Date(project.createdAt), 'MMM d, yyyy')}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProjectCard;
