import pytest
from app.db.timeline_repository import TimelineRepository
from app.schemas.persistence import TimelineSaveRequest
from app.schemas.timeline import TrackSchema, ClipSchema

@pytest.mark.asyncio
async def test_save_and_load_timeline():
    project_id = "test-proj-resume-101"
    user_id = "user-test-777"

    save_req = TimelineSaveRequest(
        projectId=project_id,
        title="Epic Vlog Cut",
        tracks=[
            TrackSchema(id="track-v", label="Main Video", type="video", clipIds=["c1"])
        ],
        clips=[
            ClipSchema(
                id="c1",
                trackId="track-v",
                name="Scene 1",
                type="video",
                start=0.0,
                duration=12.5,
                speed=1.25,
                volume=0.8
            )
        ],
        playheadTime=4.5,
        duration=12.5
    )

    # Save state
    saved = await TimelineRepository.save_timeline(save_req, user_id)
    assert saved is True

    # Rehydrate state
    loaded = await TimelineRepository.load_timeline(project_id, user_id)
    assert loaded is not None
    assert loaded.projectId == project_id
    assert loaded.title == "Epic Vlog Cut"
    assert loaded.playheadTime == 4.5
    assert len(loaded.clips) == 1
    assert loaded.clips[0].id == "c1"
    assert loaded.clips[0].speed == 1.25
    assert loaded.clips[0].volume == 0.8
