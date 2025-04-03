import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/20/solid';

interface StatsCardProps {
    title: string;
    value: string | number;
    currency?: string;
    subtext?: string;
    trend?: number;
}

const StatsCard: React.FC<StatsCardProps> = ({
    title,
    value,
    currency,
    subtext,
    trend
}) => {
    const formattedValue = currency ? `${value} ${currency}` : value;
    const trendColor = trend && trend > 0 ? 'text-green-500' : 'text-red-500';
    const trendIcon = trend && trend > 0 ? ArrowUpIcon : ArrowDownIcon;

    return (
        <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
                <div className="flex items-center">
                    <div className="flex-1">
                        <dt className="text-sm font-medium text-gray-500 truncate">
                            {title}
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">
                            {formattedValue}
                        </dd>
                        {subtext && (
                            <div className="mt-1 text-sm text-gray-500">
                                {subtext}
                            </div>
                        )}
                    </div>
                    {trend !== undefined && (
                        <div className={`flex items-center ${trendColor}`}>
                            {React.createElement(trendIcon, {
                                className: 'h-5 w-5',
                                'aria-hidden': true
                            })}
                            <span className="ml-1 text-sm font-medium">
                                {Math.abs(trend)}%
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatsCard;
