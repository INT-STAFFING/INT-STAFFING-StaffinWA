
import React from 'react';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange?: (pageSize: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ 
    currentPage, 
    totalItems, 
    itemsPerPage, 
    onPageChange, 
    onItemsPerPageChange 
}) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalItems === 0) return null;

    const handlePrevious = () => {
        if (currentPage > 1) onPageChange(currentPage - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) onPageChange(currentPage + 1);
    };

    // Genera array di pagine da mostrare (es. 1 ... 4 5 6 ... 10)
    const getPageNumbers = () => {
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) {
                pages.push(1, 2, 3, 4, 5, '...', totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }
        return pages;
    };

    return (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 py-4 px-2 border-t border-outline-variant bg-surface mt-auto">
            <div className="text-sm text-on-surface-variant">
                Mostrando <span className="font-semibold text-on-surface">{Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</span> - <span className="font-semibold text-on-surface">{Math.min(currentPage * itemsPerPage, totalItems)}</span> di <span className="font-semibold text-on-surface">{totalItems}</span> risultati
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={handlePrevious}
                    disabled={currentPage === 1}
                    className="p-2 rounded-full hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent text-on-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Pagina Precedente"
                    aria-label="Pagina precedente"
                >
                    <span className="material-symbols-outlined">chevron_left</span>
                </button>

                <div className="flex items-center gap-1">
                    {getPageNumbers().map((page, idx) => (
                        <button
                            key={idx}
                            onClick={() => typeof page === 'number' ? onPageChange(page) : null}
                            disabled={typeof page !== 'number'}
                            className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
                                ${page === currentPage
                                    ? 'bg-primary text-on-primary'
                                    : typeof page === 'number'
                                        ? 'text-on-surface hover:bg-surface-container'
                                        : 'text-on-surface-variant cursor-default'
                                }`}
                            aria-label={typeof page === 'number' ? `Pagina ${page}` : 'Interruzione elenco pagine'}
                            aria-current={page === currentPage ? 'page' : undefined}
                        >
                            {page}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleNext}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-full hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent text-on-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    title="Pagina Successiva"
                    aria-label="Pagina successiva"
                >
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>
            </div>

            {onItemsPerPageChange && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant">Righe:</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                        className="form-select py-1 pl-2 pr-8 text-xs bg-surface-container border-none rounded-lg focus:ring-1 focus:ring-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        aria-label="Seleziona righe per pagina"
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            )}
        </div>
    );
};

export default Pagination;