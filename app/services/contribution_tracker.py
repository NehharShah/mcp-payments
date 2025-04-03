from typing import List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.database import User, Contribution, Project
import aiohttp
import json

class ContributionTracker:
    def __init__(self, db: Session):
        self.db = db
        
    async def track_github_contributions(self, project_id: int, github_url: str) -> List[Dict]:
        """Track contributions from GitHub repository"""
        owner, repo = self._parse_github_url(github_url)
        contributions = []
        
        async with aiohttp.ClientSession() as session:
            # Get commits
            commits = await self._fetch_github_data(session, f"repos/{owner}/{repo}/commits")
            contributions.extend(self._process_commits(commits, project_id))
            
            # Get pull requests
            prs = await self._fetch_github_data(session, f"repos/{owner}/{repo}/pulls?state=all")
            contributions.extend(self._process_prs(prs, project_id))
            
            # Get issues
            issues = await self._fetch_github_data(session, f"repos/{owner}/{repo}/issues?state=all")
            contributions.extend(self._process_issues(issues, project_id))
        
        return contributions
    
    def calculate_contribution_score(self, user_id: int, project_id: int, timeframe_days: int = 30) -> float:
        """Calculate a user's contribution score based on their activities"""
        cutoff_date = datetime.utcnow() - timedelta(days=timeframe_days)
        
        contributions = self.db.query(Contribution).filter(
            Contribution.user_id == user_id,
            Contribution.project_id == project_id,
            Contribution.created_at >= cutoff_date
        ).all()
        
        score = 0.0
        for contrib in contributions:
            if contrib.type == "commit":
                score += 1.0 * contrib.value
            elif contrib.type == "pr":
                score += 3.0 * contrib.value
            elif contrib.type == "issue":
                score += 0.5 * contrib.value
        
        return score
    
    def get_top_contributors(self, project_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top contributors for a project"""
        contributors = (
            self.db.query(User, Contribution)
            .join(Contribution)
            .filter(Contribution.project_id == project_id)
            .group_by(User.id)
            .order_by(Contribution.value.desc())
            .limit(limit)
            .all()
        )
        
        return [
            {
                "user_id": user.id,
                "username": user.username,
                "score": self.calculate_contribution_score(user.id, project_id)
            }
            for user, _ in contributors
        ]
    
    def _parse_github_url(self, url: str) -> tuple:
        """Parse GitHub URL to get owner and repo"""
        parts = url.strip("/").split("/")
        return parts[-2], parts[-1]
    
    async def _fetch_github_data(self, session: aiohttp.ClientSession, endpoint: str) -> List[Dict]:
        """Fetch data from GitHub API"""
        github_token = "your_github_token"  # Should be in env vars
        headers = {"Authorization": f"token {github_token}"}
        async with session.get(f"https://api.github.com/{endpoint}", headers=headers) as response:
            return await response.json()
    
    def _process_commits(self, commits: List[Dict], project_id: int) -> List[Dict]:
        """Process GitHub commits data"""
        return [
            {
                "type": "commit",
                "project_id": project_id,
                "user_id": self._get_user_id(commit["author"]["login"]),
                "value": self._calculate_commit_value(commit),
                "data": json.dumps(commit)
            }
            for commit in commits if commit.get("author")
        ]
    
    def _process_prs(self, prs: List[Dict], project_id: int) -> List[Dict]:
        """Process GitHub pull requests data"""
        return [
            {
                "type": "pr",
                "project_id": project_id,
                "user_id": self._get_user_id(pr["user"]["login"]),
                "value": self._calculate_pr_value(pr),
                "data": json.dumps(pr)
            }
            for pr in prs
        ]
    
    def _process_issues(self, issues: List[Dict], project_id: int) -> List[Dict]:
        """Process GitHub issues data"""
        return [
            {
                "type": "issue",
                "project_id": project_id,
                "user_id": self._get_user_id(issue["user"]["login"]),
                "value": self._calculate_issue_value(issue),
                "data": json.dumps(issue)
            }
            for issue in issues if not issue.get("pull_request")
        ]
    
    def _get_user_id(self, github_username: str) -> int:
        """Get or create user by GitHub username"""
        user = self.db.query(User).filter(User.username == github_username).first()
        if not user:
            user = User(username=github_username)
            self.db.add(user)
            self.db.commit()
        return user.id
    
    def _calculate_commit_value(self, commit: Dict) -> float:
        """Calculate value of a commit based on changes"""
        # Implement more sophisticated logic based on commit size, complexity, etc.
        return 1.0
    
    def _calculate_pr_value(self, pr: Dict) -> float:
        """Calculate value of a pull request"""
        # Implement logic based on PR size, comments, review activity, etc.
        return 3.0
    
    def _calculate_issue_value(self, issue: Dict) -> float:
        """Calculate value of an issue"""
        # Implement logic based on issue complexity, labels, etc.
        return 0.5
