"use client";
import { Suspense, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";

function IdInner({ render }: { render: (id: string) => ReactNode }) {
  const { id } = useParams<{ id: string }>();
  return <>{render(id)}</>;
}

// Reads [id] from the address. Wrapped in Suspense as this Next.js version requires.
export function WithId({ render }: { render: (id: string) => ReactNode }) {
  return (
    <Suspense>
      <IdInner render={render} />
    </Suspense>
  );
}

function QueryInner({ name, render }: { name: string; render: (value: string | null) => ReactNode }) {
  const params = useSearchParams();
  return <>{render(params.get(name))}</>;
}

export function WithQuery({ name, render }: { name: string; render: (value: string | null) => ReactNode }) {
  return (
    <Suspense>
      <QueryInner name={name} render={render} />
    </Suspense>
  );
}

function ParamsInner({ render }: { render: (p: URLSearchParams) => ReactNode }) {
  const params = useSearchParams();
  return <>{render(new URLSearchParams(params.toString()))}</>;
}

// Reads every ?name=value from the address (Suspense-wrapped).
export function WithParams({ render }: { render: (p: URLSearchParams) => ReactNode }) {
  return (
    <Suspense>
      <ParamsInner render={render} />
    </Suspense>
  );
}
