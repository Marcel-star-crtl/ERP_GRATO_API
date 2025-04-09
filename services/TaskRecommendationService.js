// const Tasker = require('../models/Tasker');
// const Task = require('../models/Task');

// class TaskRecommendationService {
//     constructor() {}

//     calculateDistance(lat1, lon1, lat2, lon2) {
//         const R = 6371; // Earth's radius in km
//         const dLat = this.toRad(lat2 - lat1);
//         const dLon = this.toRad(lon2 - lon1);
//         const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
//                 Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
//                 Math.sin(dLon/2) * Math.sin(dLon/2);
//         const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//         return R * c;
//     }

//     toRad(value) {
//         return value * Math.PI / 180;
//     }

//     isTaskerAvailable(tasker, scheduledTime) {
//         if (!tasker.activeTask) return true;
//         // Add more sophisticated availability checking if needed
//         return false;
//     }

//     calculateTaskerScore(task, tasker, taskerHistory) {
//         // Base score starts at 100
//         let score = 100;

//         // Distance penalty (reduces score as distance increases)
//         const distance = this.calculateDistance(
//             task.location.coordinates[1],
//             task.location.coordinates[0],
//             tasker.currentLocation.coordinates[1],
//             tasker.currentLocation.coordinates[0]
//         );
//         score -= (distance * 2); // -2 points per km

//         // Category experience bonus
//         const categoryTasks = taskerHistory.filter(t => t.category === task.category).length;
//         score += (categoryTasks * 5); // +5 points per completed task in category

//         // Rating bonus
//         if (tasker.rating) {
//             score += (tasker.rating * 10); // +10 points per rating point
//         }

//         // Recent activity bonus
//         const recentTasks = taskerHistory.filter(t => {
//             const taskDate = new Date(t.completedAt);
//             const now = new Date();
//             const daysDiff = (now - taskDate) / (1000 * 60 * 60 * 24);
//             return daysDiff <= 30;
//         }).length;
//         score += (recentTasks * 2); // +2 points per recent task

//         return Math.max(0, score); // Ensure score doesn't go negative
//     }

//     async findBestMatches(task, limit = 5) {
//         const taskers = await Tasker.find({
//             currentLocation: {
//                 $near: {
//                     $geometry: task.location,
//                     $maxDistance: 50000 // 50km
//                 }
//             },
//             skills: task.category,
//             activeTask: null
//         });

//         if (taskers.length === 0) return [];

//         const matches = [];

//         for (const tasker of taskers) {
//             // Get tasker's history
//             const taskerHistory = await Task.find({
//                 assignedTasker: tasker._id,
//                 status: 'completed'
//             }).sort({ completedAt: -1 }).limit(50);

//             const score = this.calculateTaskerScore(task, tasker, taskerHistory);
            
//             matches.push({
//                 tasker,
//                 score,
//                 distance: this.calculateDistance(
//                     task.location.coordinates[1],
//                     task.location.coordinates[0],
//                     tasker.currentLocation.coordinates[1],
//                     tasker.currentLocation.coordinates[0]
//                 )
//             });
//         }

//         return matches
//             .sort((a, b) => b.score - a.score)
//             .slice(0, limit);
//     }
// }

// module.exports = new TaskRecommendationService();





const User = require('../models/User');
const Task = require('../models/Task');

class TaskRecommendationService {
    constructor() {}

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(value) {
        return value * Math.PI / 180;
    }

    isTaskerAvailable(doer, scheduledTime) {
        if (!doer.doerProfile.activeTask) {
            const scheduleDate = new Date(scheduledTime);
            const day = scheduleDate.toLocaleLowerCase('en-US', { weekday: 'long' });
            const time = scheduleDate.toLocaleTimeString('en-US', { hour12: false });

            const daySchedule = doer.doerProfile.availability.schedule.find(
                schedule => schedule.day === day && schedule.available
            );

            if (daySchedule) {
                return time >= daySchedule.hours.from && time <= daySchedule.hours.to;
            }
        }
        return false;
    }

    calculateTaskerScore(task, doer, taskerHistory) {
        let score = 100;

        // Distance penalty
        const distance = this.calculateDistance(
            task.location.coordinates[1],
            task.location.coordinates[0],
            doer.doerProfile.currentLocation.coordinates[1],
            doer.doerProfile.currentLocation.coordinates[0]
        );
        score -= (distance * 2); // -2 points per km

        // Service matching bonus
        const matchingService = doer.doerProfile.services.find(
            service => service.category === task.category
        );
        if (matchingService) {
            score += 20;
        }

        // Category experience bonus
        const categoryTasks = taskerHistory.filter(t => t.category === task.category).length;
        score += (categoryTasks * 5);

        // Rating bonus
        if (doer.doerProfile.ratings.average) {
            score += (doer.doerProfile.ratings.average * 10);
        }

        // Recent activity bonus
        const recentTasks = taskerHistory.filter(t => {
            const taskDate = new Date(t.completedAt);
            const now = new Date();
            const daysDiff = (now - taskDate) / (1000 * 60 * 60 * 24);
            return daysDiff <= 30;
        }).length;
        score += (recentTasks * 2); // +2 points per recent task

        // Completion rate bonus
        if (doer.doerProfile.completedTasks > 0) {
            score += Math.min(doer.doerProfile.completedTasks * 2, 50);
        }

        return Math.max(0, score);
    }

    async findBestMatches(task, limit = 5) {
        try {
            const normalizedCategory = task.category.toLowerCase();

            const doers = await User.find({
                role: 'doer',
                'doerProfile.currentLocation': {
                    $near: {
                        $geometry: task.location,
                        $maxDistance: 50000
                    }
                },
                'doerProfile.services.category': normalizedCategory,
                'doerProfile.activeTask': null,
                'doerProfile.availability.status': 'available'
            }).populate('doerProfile');

            console.log(`Found ${doers.length} potential doers for recommendations`);

            if (doers.length === 0) return [];

            const matches = [];

            for (const doer of doers) {
                if (this.isTaskerAvailable(doer, task.scheduledTime)) {
                    const taskerHistory = await Task.find({
                        assignedTasker: doer._id,
                        status: 'completed'
                    }).sort({ completedAt: -1 }).limit(50);

                    const score = this.calculateTaskerScore(task, doer, taskerHistory);
                    
                    matches.push({
                        doer,
                        score,
                        distance: this.calculateDistance(
                            task.location.coordinates[1],
                            task.location.coordinates[0],
                            doer.doerProfile.currentLocation.coordinates[1],
                            doer.doerProfile.currentLocation.coordinates[0]
                        )
                    });
                }
            }

            return matches
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .map(match => ({
                    doer: {
                        _id: match.doer._id,
                        fullName: match.doer.fullName,
                        profilePhoto: match.doer.profilePhoto,
                        doerProfile: {
                            ratings: match.doer.doerProfile.ratings,
                            completedTasks: match.doer.doerProfile.completedTasks,
                            hourlyRate: match.doer.doerProfile.hourlyRate
                        }
                    },
                    score: match.score,
                    distance: match.distance
                }));
        } catch (error) {
            console.error('Error in findBestMatches:', error);
            throw error;
        }
    }
}

module.exports = new TaskRecommendationService();