"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: number;
  pageTitle: string;
}

export function ReportDialog({
  open,
  onOpenChange,
  pageId,
  pageTitle,
}: ReportDialogProps) {
  const [reportType, setReportType] = useState<string>("논리적 오류");
  const [reasonText, setReasonText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reportType) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageId,
          reportType,
          reasonText: reasonText.trim() || null,
        }),
      });

      if (response.ok) {
        // Reset form and close dialog
        setReportType("논리적 오류");
        setReasonText("");
        onOpenChange(false);
        alert("신고가 접수되었습니다. 검토 후 조치하겠습니다.");
      } else {
        alert("신고 접수에 실패했습니다. 다시 시도해주세요.");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("신고 접수 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>문서 신고</DialogTitle>
          <DialogDescription>
            &quot;{pageTitle}&quot; 문서의 문제점을 신고해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-3">
            <Label>신고 유형</Label>
            <RadioGroup value={reportType} onValueChange={setReportType}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="부적절함" id="inappropriate" />
                <Label
                  htmlFor="inappropriate"
                  className="font-normal cursor-pointer"
                >
                  부적절한 내용
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="논리적 오류" id="logical-error" />
                <Label
                  htmlFor="logical-error"
                  className="font-normal cursor-pointer"
                >
                  논리적 오류 또는 모순
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="기타" id="other" />
                <Label htmlFor="other" className="font-normal cursor-pointer">
                  기타
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">상세 사유 (선택사항)</Label>
            <Textarea
              id="reason"
              placeholder="문제가 되는 부분을 구체적으로 설명해주세요..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !reportType}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                제출 중...
              </>
            ) : (
              "신고하기"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
