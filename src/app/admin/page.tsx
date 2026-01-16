import { redirect } from 'next/navigation';

// 1. Make the component async
export default async function DentistEntry() {

    // 4. Now redirect with the resolved values
    redirect(`/admin/login`);
}