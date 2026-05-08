import { getProject } from '@/app/actions/project';
import { redirect } from 'next/navigation';
import TeamInsightsClient from './TeamInsightsClient';

export default async function TeamInsightsPage({ params }) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) {
    redirect('/dashboard');
  }

  return <TeamInsightsClient project={project} />;
}
