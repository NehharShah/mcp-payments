import React from 'react';

interface StatsCardProps {
    title: string;
    value: string;
    subtext?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
    title,
    value,
    subtext
}) => {
    return (
        <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
                <div className="flex items-center">
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-500 truncate">
                            {title}
                        </p>
                        <p className="mt-1 text-3xl font-semibold text-gray-900">
                            {value}
                        </p>
                        {subtext && (
                            <p className="mt-1 text-sm text-gray-500">
                                {subtext}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsCard;
