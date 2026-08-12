import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CaseStudyRenderer } from "@/components/CaseStudyRenderer";
import { Header } from "@/components/Header";
import { getPublicProject } from "@/lib/admin/data";

type CaseStudyPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: CaseStudyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublicProject(slug);
  const document = project?.caseStudyDocument;

  if (!project || !project.hasCaseStudy || !document) {
    return {
      title: "Case Study",
    };
  }

  return {
    title: `${project.title} | Case Study`,
    description: document.summary,
  };
}

export default async function CaseStudyPage({ params }: CaseStudyPageProps) {
  const { slug } = await params;
  const project = await getPublicProject(slug);

  if (!project || !project.hasCaseStudy || !project.caseStudyDocument) notFound();

  return (
    <>
      <Header />
      <CaseStudyRenderer project={project} document={project.caseStudyDocument} />
    </>
  );
}
