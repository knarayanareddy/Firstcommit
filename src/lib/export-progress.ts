import jsPDF from "jspdf";
import "jspdf-autotable";

export interface ProgressExportData {
  userName: string;
  userEmail: string;
  packTitle: string;
  packDescription: string;
  overallProgress: number;
  modules: {
    title: string;
    difficulty?: string;
    sectionsRead: number;
    totalSections: number;
    progress: number;
    sections: { title: string; isRead: boolean }[];
  }[];
  quizScores: {
    moduleTitle: string;
    score: number;
    total: number;
  }[];
  notes: {
    moduleTitle: string;
    sectionTitle: string;
    content: string;
    date: string;
  }[];
  pathProgress: {
    type: string;
    stepsChecked: number;
    totalSteps: number;
    checkedItems: string[];
  }[];
  generatedDate: string;
}

export function generateProgressPDF(data: ProgressExportData): Blob {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 30;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // ── COVER PAGE ──
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("RocketBoard", margin, y);
  y += 12;

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text("Onboarding Progress Report", margin, y);
  y += 20;

  doc.setFontSize(11);
  const infoLines = [
    `Learner: ${data.userName}`,
    `Email: ${data.userEmail}`,
    `Pack: ${data.packTitle}`,
    `Generated: ${data.generatedDate}`,
  ];
  infoLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 7;
  });
  y += 10;

  // Progress bar (visual)
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Overall Progress: ${data.overallProgress}%`, margin, y);
  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(230, 230, 230);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 6, 3, 3, "F");
  doc.setFillColor(34, 211, 197); // primary-ish
  doc.roundedRect(margin, y, (pageWidth - margin * 2) * (data.overallProgress / 100), 6, 3, 3, "F");
  y += 16;

  // Summary stats
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const totalSections = data.modules.reduce((a, m) => a + m.totalSections, 0);
  const totalRead = data.modules.reduce((a, m) => a + m.sectionsRead, 0);
  const completedModules = data.modules.filter((m) => m.progress === 100).length;
  const quizAvg = data.quizScores.length
    ? Math.round(data.quizScores.reduce((a, q) => a + (q.score / q.total) * 100, 0) / data.quizScores.length)
    : 0;

  const stats = [
    `Modules Completed: ${completedModules}/${data.modules.length}`,
    `Sections Read: ${totalRead}/${totalSections}`,
    `Quiz Average: ${quizAvg}%`,
  ];
  data.pathProgress.forEach((p) => {
    stats.push(`${p.type} Path: ${p.stepsChecked}/${p.totalSteps} steps`);
  });
  stats.forEach((s) => {
    doc.text(s, margin, y);
    y += 7;
  });

  // ── MODULE DETAILS ──
  doc.addPage();
  y = 20;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Module Details", margin, y);
  y += 12;

  data.modules.forEach((mod) => {
    addPageIfNeeded(30 + mod.sections.length * 6);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`${mod.title}${mod.difficulty ? ` (${mod.difficulty})` : ""}`, margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Progress: ${mod.sectionsRead}/${mod.totalSections} sections (${mod.progress}%)`, margin, y);
    y += 6;

    const quiz = data.quizScores.find((q) => q.moduleTitle === mod.title);
    doc.text(quiz ? `Quiz: ${quiz.score}/${quiz.total} (${Math.round((quiz.score / quiz.total) * 100)}%)` : "Quiz: Not yet taken", margin, y);
    y += 7;

    mod.sections.forEach((s) => {
      addPageIfNeeded(6);
      doc.text(`  ${s.isRead ? "✓" : "✗"} ${s.title}`, margin + 4, y);
      y += 5;
    });
    y += 6;
  });

  // ── QUIZ SCORES TABLE ──
  if (data.quizScores.length > 0) {
    addPageIfNeeded(40);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Quiz Scores", margin, y);
    y += 8;

    (doc as any).autoTable({
      startY: y,
      head: [["Module", "Score", "Percentage"]],
      body: data.quizScores.map((q) => [
        q.moduleTitle,
        `${q.score}/${q.total}`,
        `${Math.round((q.score / q.total) * 100)}%`,
      ]),
      margin: { left: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [34, 211, 197] },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // ── NOTES ──
  if (data.notes.length > 0) {
    addPageIfNeeded(30);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Notes", margin, y);
    y += 10;

    data.notes.forEach((note) => {
      addPageIfNeeded(20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`${note.moduleTitle} > ${note.sectionTitle}`, margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(note.content, pageWidth - margin * 2);
      lines.forEach((line: string) => {
        addPageIfNeeded(5);
        doc.text(line, margin, y);
        y += 4.5;
      });
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(note.date, margin, y);
      doc.setTextColor(0, 0, 0);
      y += 8;
    });
  }

  // ── PATH PROGRESS ──
  if (data.pathProgress.length > 0) {
    addPageIfNeeded(30);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Path Progress", margin, y);
    y += 10;

    data.pathProgress.forEach((p) => {
      addPageIfNeeded(10 + p.checkedItems.length * 5);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`${p.type}: ${p.stepsChecked}/${p.totalSteps}`, margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      p.checkedItems.forEach((item) => {
        addPageIfNeeded(5);
        doc.text(`  ✓ ${item}`, margin + 4, y);
        y += 5;
      });
      y += 6;
    });
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated by RocketBoard • ${data.generatedDate} • Page ${i} of ${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    );
    doc.setTextColor(0, 0, 0);
  }

  return doc.output("blob");
}
