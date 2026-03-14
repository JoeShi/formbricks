import { notFound } from "next/navigation";
import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { getSurvey } from "@/lib/survey/service";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { AiSummaryPage } from "./components/AiSummaryPage";

const AiSummaryRoute = async (props: { params: Promise<{ environmentId: string; surveyId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { environment } = await getEnvironmentAuth(params.environmentId);

  const survey = await getSurvey(params.surveyId);

  if (!survey) {
    throw new Error(t("common.survey_not_found"));
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={survey.name}>
        <SurveyAnalysisNavigation environmentId={environment.id} survey={survey} activeId="ai-summary" />
      </PageHeader>
      <AiSummaryPage surveyId={survey.id} environmentId={environment.id} />
    </PageContentWrapper>
  );
};

export default AiSummaryRoute;
