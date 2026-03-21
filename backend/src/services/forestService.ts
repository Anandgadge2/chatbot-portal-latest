import mongoose from 'mongoose';
import ForestArea from '../models/ForestArea';
import User from '../models/User';
import { logger } from '../config/logger';

export class ForestService {
  /**
   * Find the forest area (Compartment/Beat) for a given coordinate
   */
  static async findAreaByLocation(lng: number, lat: number, companyId: any) {
    try {
      // Find all areas that contain this point
      const areas = await ForestArea.find({
        companyId: new mongoose.Types.ObjectId(companyId),
        boundary: {
          $geoIntersects: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            }
          }
        }
      });

      if (!areas || areas.length === 0) return null;

      // Priority: COMPARTMENT > BEAT > RANGE > DIVISION
      const priorityOrder = { 'COMPARTMENT': 4, 'BEAT': 3, 'RANGE': 2, 'DIVISION': 1 };
      
      return areas.sort((a, b) => 
        (priorityOrder[b.type as keyof typeof priorityOrder] || 0) - 
        (priorityOrder[a.type as keyof typeof priorityOrder] || 0)
      )[0];
    } catch (error) {
      logger.error('❌ ForestService: Error finding area by location:', error);
      return null;
    }
  }

  /**
   * Find all active officers responsible for a given area ID
   */
  static async findOfficersByArea(areaId: string, companyId: any) {
    try {
      const officers = await User.find({
        companyId: new mongoose.Types.ObjectId(companyId),
        responsibleAreas: areaId,
        isActive: true
      });
      return officers;
    } catch (error) {
      logger.error('❌ ForestService: Error finding officers by area:', error);
      return [];
    }
  }

  /**
   * Get hierarchy for notification (Beat Officers -> Range Officer -> DFO)
   */
  static async getOfficerHierarchy(areaId: string, companyId: any) {
    // Return all officers assigned to this beat/area
    const officers = await this.findOfficersByArea(areaId, companyId);
    return officers;
  }
}
