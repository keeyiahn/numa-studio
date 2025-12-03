import { useState } from 'react';

export default function useModal() {
    // Modal state
    const [ newId, setNewId ] = useState('');
    const [ type, setType ] = useState(null);
    const [ id, setId ] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [modalContent, setModalContent] = useState(null);

    // Open modal with specific content
    const openModal = (type, id, content) => {
        setId(id);
        setNewId(id);
        setType(type);
        setModalContent(content);
        setIsOpen(true);
    };

    // Close modal
    const closeModal = () => {
        setIsOpen(false);
        setModalContent(null);
    };

    return {
        newId,
        setNewId,
        type,
        id,
        setId,
        isOpen,
        modalContent,
        openModal,
        closeModal
    };
}