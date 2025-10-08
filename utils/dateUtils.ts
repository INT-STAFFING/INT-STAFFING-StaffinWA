
export const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

export const getWorkingDays = (startDate: Date, count: number): Date[] => {
    const days: Date[] = [];
    let currentDate = new Date(startDate);
    while (days.length < count) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
            days.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
};

export const getWorkingDaysBetween = (startDate: Date, endDate: Date): number => {
    let count = 0;
    const currentDate = new Date(startDate.getTime());
    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
}


export const formatDate = (date: Date, format: 'iso' | 'short' | 'day'): string => {
    if (format === 'iso') {
        return date.toISOString().split('T')[0];
    }
    if (format === 'short') {
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    }
    if (format === 'day') {
        return date.toLocaleDateString('it-IT', { weekday: 'short' });
    }
    return date.toString();
};
