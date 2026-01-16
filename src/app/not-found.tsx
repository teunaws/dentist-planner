
import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4">
            <h2 className="text-2xl font-bold">404 - Not Found</h2>
            <p>Could not find requested resource</p>
            <Link href="/" className="text-blue-500 hover:underline">
                Return Home
            </Link>
        </div>
    );
}
