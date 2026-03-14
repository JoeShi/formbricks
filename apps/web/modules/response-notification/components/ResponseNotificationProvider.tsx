"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useResponseStream } from "../hooks/useResponseStream";
import { formatResponsePreview } from "../lib/types";

interface ResponseNotificationProviderProps {
  environmentId: string;
}

export const ResponseNotificationProvider = ({ environmentId }: ResponseNotificationProviderProps) => {
  const { lastEvent } = useResponseStream(environmentId);
  const { t } = useTranslation();

  useEffect(() => {
    if (!lastEvent) return;

    const preview = formatResponsePreview(lastEvent.responseData);
    const message = `${lastEvent.surveyName}: ${preview}`;

    toast.success(t("environments.surveys.responses.new_response_notification", message), { duration: 5000 });
  }, [lastEvent, t]);

  return null;
};
