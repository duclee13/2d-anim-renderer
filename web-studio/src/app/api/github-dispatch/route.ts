import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

export async function POST(req: NextRequest) {
  try {
    const {
      action = "dispatch",
      githubToken,
      owner,
      repo,
      scriptId = "story_001",
      totalFrames = 3600,
      chunkCount = 10,
      runId,
    } = await req.json();

    const token = githubToken || process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Vui lòng cấu hình GitHub Personal Access Token (PAT) có quyền 'workflow' và 'contents:write' trong mục Cài đặt." },
        { status: 400 }
      );
    }

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Vui lòng nhập chính xác GitHub Owner và Repository (ví dụ: dudee13 / 2d-anim-renderer)." },
        { status: 400 }
      );
    }

    const octokit = new Octokit({ auth: token });

    // Kiểm tra repository có tồn tại và lấy nhánh mặc định (main hoặc master)
    let defaultBranch = "main";
    try {
      const repoInfo = await octokit.repos.get({ owner, repo });
      defaultBranch = repoInfo.data.default_branch || "main";
    } catch (repoErr: any) {
      if (repoErr.status === 404) {
        return NextResponse.json(
          {
            error: `Không tìm thấy repository '${owner}/${repo}' trên GitHub hoặc Token của bạn không có quyền truy cập repo này. Vui lòng kiểm tra lại GitHub Owner / Repo Name và quyền hạn của Token.`,
          },
          { status: 404 }
        );
      }
      throw repoErr;
    }

    // 1. DISPATCH ACTION: Kích hoạt render trên GitHub Actions
    if (action === "dispatch") {
      let targetWorkflowId: string | number = "render-2k-video.yml";

      // Kiểm tra danh sách workflow thực tế trong repo
      try {
        const workflowsRes = await octokit.actions.listRepoWorkflows({ owner, repo });
        const workflows = workflowsRes.data.workflows || [];
        const match = workflows.find(
          (w) =>
            w.path.includes("render-2k-video.yml") ||
            w.name.toLowerCase().includes("render") ||
            w.name.toLowerCase().includes("video")
        );

        if (match) {
          targetWorkflowId = match.id;
        } else if (workflows.length === 0) {
          return NextResponse.json(
            {
              error: `Repository '${owner}/${repo}' chưa có file workflow nào trên GitHub! Bạn cần đẩy (push/upload) thư mục '.github/workflows/render-2k-video.yml' lên repository này trước khi có thể kích hoạt máy chủ Render.`,
            },
            { status: 404 }
          );
        }
      } catch (listErr: any) {
        console.warn("[GitHub Dispatch] Không thể kiểm tra listRepoWorkflows:", listErr.message);
      }

      try {
        await octokit.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: targetWorkflowId,
          ref: defaultBranch,
          inputs: {
            scriptId: String(scriptId),
            totalFrames: String(totalFrames),
            chunkCount: String(chunkCount),
          },
        });

        return NextResponse.json({
          success: true,
          message: `Đã kích hoạt Workflow Dispatch thành công tới ${owner}/${repo} (nhánh ${defaultBranch}) cho kịch bản ${scriptId}!`,
        });
      } catch (dispatchErr: any) {
        if (dispatchErr.status === 404) {
          return NextResponse.json(
            {
              error: `GitHub báo lỗi 404: Không tìm thấy workflow 'render-2k-video.yml' trên nhánh '${defaultBranch}' của repo '${owner}/${repo}'. Hãy đảm bảo bạn đã đưa file '.github/workflows/render-2k-video.yml' lên GitHub.`,
            },
            { status: 404 }
          );
        }
        throw dispatchErr;
      }
    }

    // 2. STATUS ACTION: Kiểm tra trạng thái render
    if (action === "status") {
      try {
        const runs = await octokit.actions.listWorkflowRunsForRepo({
          owner,
          repo,
          per_page: 5,
        });

        const latestRun = runs.data.workflow_runs[0];
        return NextResponse.json({
          success: true,
          run: latestRun
            ? {
                id: latestRun.id,
                status: latestRun.status,
                conclusion: latestRun.conclusion,
                html_url: latestRun.html_url,
                created_at: latestRun.created_at,
                updated_at: latestRun.updated_at,
              }
            : null,
        });
      } catch (statusErr: any) {
        return NextResponse.json(
          { error: `Không thể đọc trạng thái workflow: ${statusErr.message}` },
          { status: 500 }
        );
      }
    }

    // 3. RELEASE ASSET: Lấy đường link tải video hoàn thiện
    if (action === "get-release") {
      try {
        const releases = await octokit.repos.listReleases({
          owner,
          repo,
          per_page: 5,
        });

        const matchingRelease =
          releases.data.find(
            (rel) => rel.tag_name.includes(scriptId) || rel.name?.includes(scriptId)
          ) || releases.data[0];

        if (!matchingRelease) {
          return NextResponse.json({
            success: false,
            message: "Chưa tìm thấy bản Release thành phẩm.",
          });
        }

        const asset = matchingRelease.assets.find((a) => a.name.endsWith(".mp4"));

        return NextResponse.json({
          success: true,
          releaseTag: matchingRelease.tag_name,
          downloadUrl: asset ? asset.browser_download_url : null,
          releaseUrl: matchingRelease.html_url,
        });
      } catch (releaseErr: any) {
        return NextResponse.json(
          { error: `Không thể tìm thấy Release: ${releaseErr.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  } catch (error: any) {
    console.error("GitHub Dispatch API Error:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi khi giao tiếp với GitHub API" },
      { status: 500 }
    );
  }
}
